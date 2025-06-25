import fs from 'fs'
import axios from 'axios'

const BASE_URL = 'https://bb6c465d-8428-44bb-b7b0-ea316ea8b65d-00-1xcez0bv75jsa.sisko.replit.dev'
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODVhNGY1YjhmYmM1OTRiOGIxZGRkYzUiLCJpc0FkbWluIjp0cnVlLCJpYXQiOjE3NTA4MzI1MTIsImV4cCI6MTc1MDgzOTcxMn0.Phsu0eYaxG5ttUQ1GVp3Aew-2va47_Er8ESRk6hkTP0' // Replace with valid token

const topics = JSON.parse(fs.readFileSync('./topics.json', 'utf-8'))

function cleanContent(content) {
  return content.replace(/<p>nan<\/p>/g, '<p></p>').trim()
}

async function uploadTopics() {
  for (const topic of topics) {
    topic.content = cleanContent(topic.content)

    try {
      const res = await axios.post(`${BASE_URL}/api/topics/add`, topic, {
        headers: { Authorization: `Bearer ${TOKEN}` }
      })
      console.log(`✅ Uploaded: ${topic.title}`)
    } catch (err) {
      console.error(`❌ Failed to upload: ${topic.title}`)
      console.error(err.response?.data || err.message)
    }
  }
}

uploadTopics()
