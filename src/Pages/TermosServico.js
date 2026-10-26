import Header from '../components/Header/Header';
import Footer from '../components/Footer/Footer';
import { Container } from 'react-bootstrap';

function TermosServico() {
  return (
    <>
      <Header />
      <main className="flex-grow-1">
        <Container className="py-5">
          <h1>Termos de Serviço</h1>
          <p>
            Ao utilizar nossa aplicação integrada ao Meta Business Suite, você concorda com os
            termos descritos abaixo.
          </p>

          <h2>1. Uso do Serviço</h2>
          <p>
            <strong>Elegibilidade:</strong> Você deve possuir autorização e permissões
            administrativas válidas na conta do Meta Business Suite, Páginas do Facebook ou
            Perfis do Instagram que conectar ao aplicativo.
          </p>
          <p>
            <strong>Conformidade:</strong> Você se compromete a utilizar o serviço em conformidade
            com as diretrizes e políticas da Meta, além de respeitar a legislação aplicável.
          </p>

          <h2>2. Permissões e Acesso</h2>
          <p>
            Ao autorizar o aplicativo no Meta Business Suite, você nos concede permissão para
            acessar os dados e executar ações estritamente necessárias para a prestação do serviço
            contratado ou configurado. Você pode revogar essa permissão a qualquer momento através
            das configurações de integrações da própria Meta.
          </p>

          <h2>3. Responsabilidades do Usuário</h2>
          <p>
            Você é o único responsável pelo conteúdo publicado, mensagens enviadas ou ações
            automatizadas realizadas através do aplicativo em suas contas do Meta Business Suite.
          </p>

          <h2>4. Disponibilidade e Modificações</h2>
          <p>
            Trabalhamos para manter a disponibilidade e estabilidade do serviço, mas não
            garantimos operação contínua sem interrupções.
          </p>
          <p>
            Reservamo-nos o direito de alterar, suspender ou descontinuar recursos do aplicativo a
            qualquer momento, mediante aviso prévio quando aplicável.
          </p>

          <h2>5. Limitação de Responsabilidade</h2>
          <p>
            Não nos responsabilizamos por perdas de dados, indisponibilidades temporárias
            decorrentes de falhas na API da Meta ou bloqueios aplicados pela própria Meta à sua
            conta por violação das políticas da plataforma.
          </p>

          <h2>6. Cancelamento e Rescisão</h2>
          <p>
            Você pode encerrar o uso do serviço a qualquer momento desconectando a aplicação do
            seu Meta Business Suite. Reservamo-nos o direito de suspender o acesso de contas que
            violem estes termos.
          </p>

          <h2>7. Contato</h2>
          <p>
            Dúvidas sobre estes Termos de Serviço podem ser enviadas para:{' '}
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

export default TermosServico;
