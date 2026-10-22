import { Routes, Route } from 'react-router';
import Home from './Pages/Home';
import Team from './Pages/Team';
import Formulario from './Pages/Formulario';
import CalendarioPage from './Pages/Calendario/CalendarioPage';
import PoliticaPrivacidade from './Pages/PoliticaPrivacidade';
import TermosServico from './Pages/TermosServico';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/team' element={<Team />} />
        <Route path='/formulario' element={<Formulario />} />
        <Route path='/calendario' element={<CalendarioPage />} />
        <Route path='/politica-de-privacidade' element={<PoliticaPrivacidade />} />
        <Route path='/termos-de-servico' element={<TermosServico />} />
      </Routes>
    </div>
  );
}

export default App;
