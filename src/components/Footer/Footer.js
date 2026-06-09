import { Container, Navbar } from 'react-bootstrap';
import './Footer.css';

function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <Navbar className='footer' fixed='bottom'>
      <Container className='justify-content-center text-center'>
        <span>© {currentYear} Boomer Investimentos - Rua da Bahia, 905, Sala 1507 - Belo Horizonte MG</span>
      </Container>
    </Navbar>
  );
}

export default Footer;