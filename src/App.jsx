import React from 'react'
import { observer } from 'mobx-react-lite'
import './App.css'
import { Canvas } from './components/Canvas'
import { FloatingButtons } from './components/FloatingButtons'
import { ModelModal } from './components/ModelModal'
import { modelConfigStore } from './stores'

const App = observer(() => {
  return (
    <>
      <Canvas />
      <FloatingButtons />
      {modelConfigStore.showModal && <ModelModal />}
    </>
  )
})

export default App
