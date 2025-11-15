import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import NftMinter from './components/NftMinter'
import MobileUploader from './components/MobileUploader'

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
  },
})

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<NftMinter />} />
          <Route path="/upload/:sessionId" element={<MobileUploader />} />
        </Routes>
      </Router>
    </ThemeProvider>
  )
}
export default App
