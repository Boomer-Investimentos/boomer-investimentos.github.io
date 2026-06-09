import Header from '../components/Header/Header';
import Footer from '../components/Footer/Footer';
import { Container } from 'react-bootstrap';

function Team() {
  return (
    <>
      <Header />
      <main className="flex-grow-1">
        <Container className="py-5">
          <h1>Assessores de Investimentos</h1>
          <p>Wagner Mendonça Costa - CPF 155.502.906-22</p>
          <p>Filipe Almeida Vasconcellos - CPF 107.505.116-99</p>
        </Container>
      </main>
      <Footer />
    </>
  );
};

export default Team;