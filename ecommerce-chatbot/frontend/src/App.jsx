import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Chat from './components/Chat'
import Pay from './components/Pay'
import Track from './components/Track'
import './index.css'

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/pay/:trackId" element={<Pay />} />
          <Route path="/track/:trackId?" element={<Track />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
