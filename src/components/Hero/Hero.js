import heroImage from '../../assets/imgs/hero-img.webp';
import { Container, Row, Col, Image } from 'react-bootstrap';

function Hero() {
  return (
    <Container className='my-5 text-start'>
      <Row className="d-flex align-items-center">
        <Col xs={12} md={6} className="mb-4 mb-md-0">
          <h1>A maioria das pessoas não quer se procupar com investimentos. <br />E sinceramente, nós também não.</h1>
          <p>O que as pessoas querem — de verdade — é alcançar seus objetivos:
            fazer aquela viagem, garantir a escola dos filhos, construir patrimônio, ter liberdade.
          </p>
          <p>
            Foi por isso que criamos a <b>Boomer Investimentos.</b>
          </p>
          <p>
            Para ser o parceiro que cuida da parte chata, técnica e complexa — e traduz tudo isso em decisões simples, seguras e alinhadas com o que você realmente quer da vida.
          </p>
          <p>
            Aqui, a conversa começa com você. Seus planos. Seus sonhos.
            E, a partir disso, montamos uma estratégia que conecta o agora com o futuro.
          </p>
          <p>
            Sem economês. Sem falar bonito pra impressionar. Sem empurrar produto.
            Só um plano financeiro real, pensado de verdade, com quem entende e se importa.
          </p>
        </Col>
        <Col xs={12} md={6}>
          <Image src={heroImage} alt="Imagem de mulher" fluid />
        </Col>
      </Row>
    </Container>
  );
}

export default Hero;