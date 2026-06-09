import styles from './Main.module.css';
import boomerWarrenBanner from '../../assets/imgs/banner_boomer_warren_black_.webp';
import cvmLogo from '../../assets/imgs/cvm-logo.webp';
import ancordLogo from '../../assets/imgs/logo_ancord.webp';
import bsmLogo from '../../assets/imgs/logo_bsm_supervisao_de_mercados.webp';
import LocationMap from '../Map/LocationMap';
import { Container, Image, Row, Col } from 'react-bootstrap';

function Main() {
  return (
    <>
      <div className={styles.contactInfo}>
        <Container>
          <Row className="align-items-center">
            <Col xs={12} md={6} className='mb-4 mb-md-0'>
              <LocationMap />
            </Col>
            <Col xs={12} md={6}>
              <div className={styles.contactText}>
                <h3>Contate-nos</h3>
                <br />
                <span>Boomer Investimentos</span>
                <br />
                <span>Rua da Bahia, 905, Sala 1507 - Belo Horizonte - MG</span>
                <br />
                <br />
                <span>Telefone: (38) 98411 3536</span>
                <br />
                <br />
                <span>boomer@boomerinvestimentos.com.br</span>
              </div>
            </Col>
          </Row>
        </Container>
      </div >
      <Container className="text-center my-5">
        <Row className="align-items-center">
          <Col xs={12} md={4}>
            <Image src={cvmLogo} alt="Logo da CVM" fluid />
          </Col>
          <Col xs={12} md={4} className="mb-4 mb-md-0">
            <Image src={ancordLogo} alt="Logo da Ancord" fluid />
          </Col>
          <Col xs={12} md={4} className="mb-4 mb-md-0">
            <Image src={bsmLogo} alt="Logo da BSM" fluid /></Col>
        </Row>
      </Container>
      <div className="bg-light p-3 p-lg-5 w-100 mx-auto" style={{ maxWidth: '500px' }}>
        <Container>
          <div className={styles.ouvidoria}>
            <h2 className='text-center'>OUVIDORIA</h2>
            <h3>Ainda precisa de ajuda?</h3>
            <p>
              Email: ouvidoria@warren.com.br
              <br />
              Telefone: 0800 6054 9000
              <br />
              Atendimento das 10h às 17h (dias úteis)
              <br />
              R. Teodoro Sampaio, 2700, 9 Andar - Pinheiros, São Paulo - SP, 05426-100
            </p>
          </div>
        </Container >
      </div>
      <Container className='text-center'>
        <Image src={boomerWarrenBanner} alt="Boomer Investimentos - Warren Logo" className={styles.boomerWarrenBanner} />
        <p className={styles.disclaimer}>
          A Renascença Distribuidora de Títulos e Valores Mobiliários Ltda(&apos;Warren Rena&apos;), inscrita sob o CNPJ: 62.287.735/0001-03 , é uma empresa de Assessores de Investimento devidamente registrada na Comissão de Valores Mobiliários (CVM), conforme a Resolução CVM 178/2023. A Renascença Distribuidora de Títulos e Valores Mobiliários Ltda(&apos;Warren Rena&apos;), atua no mercado financeiro credenciada à Warren Corretora de Valores Mobiliários e Câmbio LTDA., o que pode ser verificado através do site da CVM (www.cvm.gov.br &gt; Assessores de Investimentos &gt; Relação dos Assessores de Investimentos contratados por uma Instituição Financeira &gt; Corretoras &gt; Warren Investimentos) ou no site da própria Warren Corretora. O Assessor de Investimentos é um intermediário e depende da autorização prévia do cliente para realizar operações no mercado financeiro. A realização de operações com derivativos envolve riscos, incluindo a possibilidade de perdas superiores aos valores investidos, podendo resultar em significativas perdas patrimoniais. Para mais informações e dúvidas, entre em contato com seu Assessor de Investimentos. Para reclamações, favor contatar a Ouvidoria da Warren Investimentos pelo telefone 0800 6054 900 ou pelo e-mail ouvidoria@warren.com.br. As informações contidas nesta página têm caráter meramente informativo, não constituindo e nem devendo ser interpretadas como solicitações de compra ou venda, ofertas ou recomendações de ativos financeiros, investimentos, sugestões de alocação ou adoção de estratégias.
        </p>
      </Container>
    </>
  );
};

export default Main;
