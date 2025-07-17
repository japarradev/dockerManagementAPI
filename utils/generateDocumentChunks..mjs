import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { DocxLoader } from 'langchain/document_loaders/fs/docx'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import XLSX from 'xlsx'

/**
 * Generates text chunks from a document (PDF, Word, or Excel) using LangChain
 * @param {string} documentUrl - URL or file path to the document
 * @param {number} chunkSize - Size of each chunk in characters (default: 1000)
 * @param {number} overlapLength - Number of characters to overlap between chunks (default: 200)
 * @returns {Promise<Array>} Array of text chunks
 */
async function generateDocumentChunks (documentUrl, chunkSize = 1000, overlapLength = 200) {
  try {
    // Input validation
    if (!documentUrl || typeof documentUrl !== 'string') {
      throw new Error('Document URL is required and must be a string')
    }

    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new Error('Chunk size must be a positive integer')
    }

    if (!Number.isInteger(overlapLength) || overlapLength < 0) {
      throw new Error('Overlap length must be a non-negative integer')
    }

    if (overlapLength >= chunkSize) {
      throw new Error('Overlap length must be less than chunk size')
    }

    let filePath
    let isTemporaryFile = false

    // Check if documentUrl is a URL or local file path
    if (documentUrl.startsWith('http://') || documentUrl.startsWith('https://')) {
      // Download document from URL
      console.log('Downloading document from URL...')
      filePath = await downloadDocument(documentUrl)
      isTemporaryFile = true
    } else {
      // Local file path
      filePath = documentUrl
    }

    // Validate file existence
    if (!fs.existsSync(filePath)) {
      throw new Error(`Document file not found: ${filePath}`)
    }

    // Get file extension and validate type
    let fileExtension = path.extname(filePath).toLowerCase()

    // If no extension (from downloaded .tmp file), detect from file content
    if (!fileExtension || fileExtension === '.tmp') {
      console.log('Detecting file type from content...')
      fileExtension = detectFileTypeFromContent(filePath)

      if (!fileExtension) {
        throw new Error('Could not determine file type from content')
      }

      // Rename file with correct extension
      const newFilePath = filePath.replace(/\.tmp$/, fileExtension)
      fs.renameSync(filePath, newFilePath)
      filePath = newFilePath
    }

    const supportedTypes = ['.pdf', '.docx', '.xlsx']

    if (!supportedTypes.includes(fileExtension)) {
      throw new Error(`Unsupported file type. Supported types: ${supportedTypes.join(', ')}`)
    }

    // Validate file format
    await validateFileFormat(filePath, fileExtension)

    console.log(`Loading ${fileExtension.toUpperCase()} document...`)

    // Load document based on type
    let documents
    switch (fileExtension) {
      case '.pdf':
        documents = await loadPDFDocument(filePath)
        break
      case '.docx':
        documents = await loadWordDocument(filePath)
        break
      case '.xlsx':
        documents = await loadExcelDocument(filePath)
        break
      default:
        throw new Error(`Unsupported file type: ${fileExtension}`)
    }

    if (!documents || documents.length === 0) {
      throw new Error('No content found in document')
    }

    console.log(`Document loaded successfully. Found ${documents.length} sections.`)

    // Create text splitter with specified parameters
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap: overlapLength,
      separators: ['\n\n', '\n', '. ', ' ', '']
    })

    console.log('Splitting text into chunks...')

    // Split documents into chunks
    const chunks = await textSplitter.splitDocuments(documents)

    console.log(`Successfully created ${chunks.length} chunks.`)

    // Clean up temporary file if it was downloaded
    if (isTemporaryFile) {
      fs.unlinkSync(filePath)
      console.log('Temporary file cleaned up.')
    }

    // Return formatted chunks
    return chunks.map((chunk, index) => ({
      id: index + 1,
      content: chunk.pageContent,
      metadata: {
        ...chunk.metadata,
        chunkSize: chunk.pageContent.length,
        chunkIndex: index,
        documentType: fileExtension
      }
    }))
  } catch (error) {
    console.error('Error generating document chunks:', error.message)
    throw error
  }
}

/**
 * Downloads a document file from a URL
 * @param {string} url - URL to download document from
 * @returns {Promise<string>} Path to downloaded file
 */
function downloadDocument (url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https://') ? https : http

    const request = client.get(url, (response) => {
      // Check if response is successful
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download document. Status code: ${response.statusCode}`))
        return
      }

      // Try to determine file extension from URL or Content-Type
      let fileExtension = getFileExtensionFromUrl(url)

      // If no extension from URL, try from Content-Type header
      if (!fileExtension) {
        const contentType = response.headers['content-type']
        fileExtension = getExtensionFromContentType(contentType)
      }

      // If still no extension, default to .tmp and we'll detect later
      if (!fileExtension) {
        fileExtension = '.tmp'
      }

      const tempFilePath = path.join(process.cwd(), 'tmp', `temp_${Date.now()}${fileExtension}`)
      const file = fs.createWriteStream(tempFilePath)

      response.pipe(file)

      file.on('finish', () => {
        file.close()
        resolve(tempFilePath)
      })

      file.on('error', (error) => {
        reject(new Error(`File write error: ${error.message}`))
      })
    })

    request.on('error', (error) => {
      reject(new Error(`Download failed: ${error.message}`))
    })
  })
}

/**
 * Extracts file extension from URL
 * @param {string} url - URL to extract extension from
 * @returns {string|null} File extension or null
 */
function getFileExtensionFromUrl (url) {
  try {
    const parsedUrl = new URL(url)
    const pathname = parsedUrl.pathname
    const extension = path.extname(pathname).toLowerCase()

    // Check if it's a supported extension
    const supportedExtensions = ['.pdf', '.docx', '.xlsx']
    return supportedExtensions.includes(extension) ? extension : null
  } catch (error) {
    return null
  }
}

/**
 * Maps Content-Type to file extension
 * @param {string} contentType - Content-Type header value
 * @returns {string|null} File extension or null
 */
function getExtensionFromContentType (contentType) {
  if (!contentType) return null

  const contentTypeMap = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/msword': '.docx', // fallback for older Word docs
    'application/vnd.ms-excel': '.xlsx' // fallback for older Excel docs
  }

  // Clean content type (remove charset and other parameters)
  const cleanContentType = contentType.split(';')[0].trim().toLowerCase()

  return contentTypeMap[cleanContentType] || null
}

/**
 * Validates file format based on file signatures
 * @param {string} filePath - Path to the file
 * @param {string} expectedExtension - Expected file extension
 */
async function validateFileFormat (filePath, expectedExtension) {
  const fileBuffer = fs.readFileSync(filePath)

  switch (expectedExtension) {
    case '.pdf':
      if (!isPDFFile(fileBuffer)) {
        throw new Error('File is not a valid PDF document')
      }
      break
    case '.docx':
      if (!isWordFile(fileBuffer)) {
        throw new Error('File is not a valid Word document')
      }
      break
    case '.xlsx':
      if (!isExcelFile(fileBuffer)) {
        throw new Error('File is not a valid Excel document')
      }
      break
  }
}

/**
 * Loads PDF document using LangChain PDFLoader
 * @param {string} filePath - Path to PDF file
 * @returns {Promise<Array>} Array of document objects
 */
async function loadPDFDocument (filePath) {
  const loader = new PDFLoader(filePath)
  return await loader.load()
}

/**
 * Loads Word document using LangChain DocxLoader
 * @param {string} filePath - Path to Word file
 * @returns {Promise<Array>} Array of document objects
 */
async function loadWordDocument (filePath) {
  const loader = new DocxLoader(filePath)
  return await loader.load()
}

/**
 * Loads Excel document and converts to text format
 * @param {string} filePath - Path to Excel file
 * @returns {Promise<Array>} Array of document objects
 */
async function loadExcelDocument (filePath) {
  const workbook = XLSX.readFile(filePath)
  const documents = []

  workbook.SheetNames.forEach((sheetName, index) => {
    const worksheet = workbook.Sheets[sheetName]
    const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

    // Convert sheet data to text
    let sheetText = `Sheet: ${sheetName}\n\n`

    sheetData.forEach((row, rowIndex) => {
      if (row.some(cell => cell !== '')) { // Skip empty rows
        const rowText = row.map(cell => String(cell).trim()).join(' | ')
        sheetText += `Row ${rowIndex + 1}: ${rowText}\n`
      }
    })

    if (sheetText.trim().length > `Sheet: ${sheetName}`.length) {
      documents.push({
        pageContent: sheetText,
        metadata: {
          source: filePath,
          sheetName,
          sheetIndex: index,
          type: 'excel'
        }
      })
    }
  })

  return documents
}

/**
 * Detects file type from file content when extension is not available
 * @param {string} filePath - Path to the file
 * @returns {string|null} Detected file extension or null
 */
function detectFileTypeFromContent (filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath)

    // Check for PDF signature
    if (isPDFFile(fileBuffer)) {
      return '.pdf'
    }

    // Check for ZIP-based files (Word and Excel)
    if (isWordFile(fileBuffer) || isExcelFile(fileBuffer)) {
      // Need to differentiate between Word and Excel
      // This is a basic check - in practice, you might want more sophisticated detection
      return detectWordOrExcel(fileBuffer)
    }

    return null
  } catch (error) {
    console.error('Error detecting file type:', error.message)
    return null
  }
}

/**
 * Differentiates between Word and Excel files (both are ZIP-based)
 * @param {Buffer} buffer - File buffer
 * @returns {string} File extension (.docx or .xlsx)
 */
function detectWordOrExcel (buffer) {
  try {
    // This is a simplified detection - both Word and Excel are ZIP files
    // In a real-world scenario, you might want to extract and check internal structure
    // For now, we'll try to read as Excel first, if it fails, assume Word
    const tempPath = path.join(__dirname, `temp_detect_${Date.now()}.tmp`)
    fs.writeFileSync(tempPath, buffer)

    try {
      // Try to read as Excel
      XLSX.readFile(tempPath)
      fs.unlinkSync(tempPath)
      return '.xlsx'
    } catch (excelError) {
      // If Excel reading fails, assume it's Word
      fs.unlinkSync(tempPath)
      return '.docx'
    }
  } catch (error) {
    // If all else fails, default to .docx
    return '.docx'
  }
}

function isPDFFile (buffer) {
  if (!buffer || buffer.length < 4) {
    return false
  }

  // Check PDF signature (%PDF)
  const pdfSignature = buffer.slice(0, 4).toString('ascii')
  return pdfSignature === '%PDF'
}

/**
 * Validates if a file is a valid Word document by checking its header
 * @param {Buffer} buffer - File buffer to check
 * @returns {boolean} True if file is a valid Word document
 */
function isWordFile (buffer) {
  if (!buffer || buffer.length < 4) {
    return false
  }

  // Check ZIP signature (Word documents are ZIP files)
  const zipSignature = buffer.slice(0, 4)
  return (zipSignature[0] === 0x50 && zipSignature[1] === 0x4B &&
          zipSignature[2] === 0x03 && zipSignature[3] === 0x04) ||
         (zipSignature[0] === 0x50 && zipSignature[1] === 0x4B &&
          zipSignature[2] === 0x05 && zipSignature[3] === 0x06) ||
         (zipSignature[0] === 0x50 && zipSignature[1] === 0x4B &&
          zipSignature[2] === 0x07 && zipSignature[3] === 0x08)
}

/**
 * Validates if a file is a valid Excel document by checking its header
 * @param {Buffer} buffer - File buffer to check
 * @returns {boolean} True if file is a valid Excel document
 */
function isExcelFile (buffer) {
  if (!buffer || buffer.length < 4) {
    return false
  }

  // Check ZIP signature (Excel documents are ZIP files)
  const zipSignature = buffer.slice(0, 4)
  return (zipSignature[0] === 0x50 && zipSignature[1] === 0x4B &&
          zipSignature[2] === 0x03 && zipSignature[3] === 0x04) ||
         (zipSignature[0] === 0x50 && zipSignature[1] === 0x4B &&
          zipSignature[2] === 0x05 && zipSignature[3] === 0x06) ||
         (zipSignature[0] === 0x50 && zipSignature[1] === 0x4B &&
          zipSignature[2] === 0x07 && zipSignature[3] === 0x08)
}

export default generateDocumentChunks
