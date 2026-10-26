import { Container, Navbar } from 'react-bootstrap';
import { Link } from 'react-router';
import './Footer.css';

function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <Navbar className='footer' fixed='bottom'>
      <Container className='d-flex flex-column flex-md-row justify-content-center align-items-center gap-2 text-center'>
        <span>© {currentYear} Boomer Investimentos - Rua da Bahia, 905, Sala 1507 - Belo Horizonte MG</span>
        <span className='d-flex gap-3'>
          <Link to='/politica-de-privacidade'>Política de Privacidade</Link>
          <Link to='/termos-de-servico'>Termos de Serviço</Link>
        </span>
      </Container>
    </Navbar>
  );
}

export default Footer;