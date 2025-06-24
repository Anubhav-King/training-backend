import fs from 'fs'
import axios from 'axios'

const BASE_URL = 'https://bb6c465d-8428-44bb-b7b0-ea316ea8b65d-00-1xcez0bv75jsa.sisko.replit.dev' // 🔁 Replace with your actual backend URL
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2ODVhNGY1YjhmYmM1OTRiOGIxZGRkYzUiLCJpc0FkbWluIjp0cnVlLCJpYXQiOjE3NTA3NTY5NzcsImV4cCI6MTc1MDc2MDU3N30.xfe6mI4tYe75vx_E3zvDjnuUNrlPKpyZ7C1gIX1lcpo' // 🔑 Paste a valid JWT token here

const topics = JSON.parse(fs.readFileSync('./topics.json', 'utf-8'))

async function uploadTopics() {
  for (const topic of topics) {
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
