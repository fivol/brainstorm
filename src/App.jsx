import { useState } from 'react'
import './App.css'

function App() {
  const [notification, setNotification] = useState(null)

  const handleButtonClick = () => {
    setNotification('Button clicked!')
    
    // Clear notification after 3 seconds
    setTimeout(() => {
      setNotification(null)
    }, 3000)
  }

  return (
    <div className="app">
      <h1>Simple App</h1>
      <button onClick={handleButtonClick} className="button">
        Click Me
      </button>
      
      {notification && (
        <div className="notification">
          {notification}
        </div>
      )}
    </div>
  )
}

export default App
