import Header from '../components/Header/Header';
import Footer from '../components/Footer/Footer';
import { Container } from 'react-bootstrap';

function PoliticaPrivacidade() {
  return (
    <>
      <Header />
      <main className="flex-grow-1">
        <Container className="py-5">
          <h1>Política de Privacidade</h1>
          <p>
            Este Aviso de Privacidade descreve como coletamos, usamos, armazenamos e protegemos os
            seus dados pessoais ao utilizar nossa aplicação integrada ao Meta Business Suite.
          </p>

          <h2>1. Coleta e Uso de Dados</h2>
          <p>
            Coletamos apenas os dados necessários para o funcionamento e fornecimento dos nossos
            serviços através da API da Meta. Esses dados podem incluir:
          </p>
          <ul>
            <li>
              <strong>Informações de Perfil e Conta:</strong> Nome, ID do usuário da Meta,
              endereço de e-mail e foto de perfil.
            </li>
            <li>
              <strong>Dados de Páginas e Negócios:</strong> Informações sobre as Páginas do
              Facebook e contas do Instagram vinculadas à sua conta do Meta Business Suite.
            </li>
            <li>
              <strong>Conteúdo e Interações:</strong> Mensagens, comentários e dados analíticos de
              desempenho de publicações autorizados por você.
            </li>
          </ul>
          <p>
            <strong>Finalidade:</strong> Utilizaremos esses dados exclusivamente para gerenciar,
            automatizar ou otimizar as funcionalidades do aplicativo solicitadas por você no Meta
            Business Suite.
          </p>

          <h2>2. Compartilhamento de Dados</h2>
          <p>
            Não vendemos, alugamos nem compartilhamos seus dados pessoais com terceiros para fins
            de marketing ou comerciais. Seus dados só serão compartilhados:
          </p>
          <ul>
            <li>
              Com provedores de serviços essenciais à infraestrutura do aplicativo (como serviços
              de hospedagem e banco de dados em nuvem).
            </li>
            <li>Para cumprimento de obrigações legais ou judiciais.</li>
          </ul>

          <h2>3. Armazenamento e Segurança</h2>
          <p>
            Adotamos medidas técnicas e organizacionais adequadas (criptografia, controle de
            acesso restrito) para proteger seus dados contra acessos não autorizados, perda ou
            alteração. Os dados serão retidos apenas pelo período necessário para prestação do
            serviço ou conforme exigido por lei.
          </p>

          <h2>4. Seus Direitos (LGPD)</h2>
          <p>
            Nos termos da Lei Geral de Proteção de Dados (LGPD), você tem direito a:
          </p>
          <ul>
            <li>Confirmar a existência e acessar seus dados.</li>
            <li>Solicitar a correção de dados incompletos ou desatualizados.</li>
            <li>
              Revogar a autorização de acesso ao aplicativo no seu Meta Business Suite a qualquer
              momento.
            </li>
            <li>Solicitar a exclusão definitiva dos seus dados armazenados em nossos sistemas.</li>
          </ul>

          <h2>5. Exclusão de Dados</h2>
          <p>
            Você pode remover o acesso da nossa aplicação diretamente nas configurações de
            permissões do Meta/Facebook ou solicitar a exclusão total dos seus dados enviando um
            e-mail para:{' '}
            <a href="mailto:boomer@boomerinvestimentos.com.br">
              boomer@boomerinvestimentos.com.br
            </a>
            .
          </p>

          <h2>6. Contato</h2>
          <p>
            Se você tiver dúvidas sobre este Aviso de Privacidade, entre em contato através do
            e-mail:{' '}
            <a href="mailto:boomer@boomerinvestimentos.com.br">
              boomer@boomerinvestimentos.com.br
            </a>
          </p>
        </Container>
      </main>
      <Footer />
    </>
  );
}

export default PoliticaPrivacidade;
