import { StudioBrand } from "../auth/AuthShell";
import "./privacy.css";
export default function PrivacyPage() {
  return (
    <main className="privacy-document">
      <StudioBrand />
      <a href="/minha-conta">Voltar à plataforma</a>
      <h1>Política de privacidade</h1>
      <p>Versão 1.0 — 21 de outubro de 2026</p>
      <p>
        O Serga Studio é operado por Adriel Barboza Ripoll, CNPJ
        51.067.758/0001-88. Nosso contato de privacidade é{" "}
        <a href="mailto:sergastudio@outlook.com">sergastudio@outlook.com</a>.
      </p>
      <h2>Dados e finalidades</h2>
      <p>
        Tratamos nome, email, celular, identificação da conta e informações de
        autenticação para criar e proteger seu acesso; clientes, tarefas, feeds,
        imagens e métricas para oferecer as ferramentas; e referências de
        cobrança, pagamentos e aceites para administrar a assinatura e cumprir
        obrigações aplicáveis.
      </p>
      <p>
        O pagamento com cartão acontece no ambiente do Asaas. Não armazenamos
        números completos de cartão ou código de segurança. Não solicitamos
        informações pessoais sensíveis para utilizar as ferramentas.
      </p>
      <p>
        Os tratamentos necessários ao serviço e à assinatura se apoiam na
        execução do contrato e em procedimentos relacionados. Conservações
        obrigatórias seguem a obrigação legal ou regulatória e o exercício
        regular de direitos, conforme o registro. Segurança e melhoria do
        produto dependem de necessidade e avaliação dos interesses e direitos
        envolvidos. Consentimentos específicos, quando necessários, são
        apresentados separadamente; ler esta política não autoriza marketing.
      </p>
      <h2>Fornecedores e segurança</h2>
      <p>
        Utilizamos Supabase para autenticação e armazenamento privado de
        arquivos, Postgres para os registros da aplicação e Asaas para
        cobranças. Serviços transacionais de email podem ser utilizados para
        confirmação, recuperação de acesso e avisos da conta. Esses fornecedores
        tratam os dados necessários às suas funções; os ambientes e regiões de
        produção devem ser confirmados antes do lançamento comercial.
      </p>
      <p>
        As sessões usam cookies HttpOnly, com proteção contra requisições
        indevidas. O armazenamento é privado e as URLs temporárias de arquivos
        podem ser acessadas por quem as possuir durante sua validade.
        Compartilhe-as com cuidado. Adotamos controles de acesso e minimização,
        sem prometer ausência absoluta de incidentes.
      </p>
      <h2>Retenção e exclusão</h2>
      <p>
        Teste ou acesso pago válido preserva o conteúdo. Sem nova contratação,
        arquivos seguem retenção de 1 mês após o teste para quem nunca pagou e
        de 6 meses após o último período pago. Cadastro e dados das ferramentas
        seguem 12 e 24 meses, respectivamente. São meses de calendário, com
        ajuste para meses curtos, no horário de São Paulo. Um novo login não
        reinicia os prazos.
      </p>
      <p>
        Antes da remoção dos dados de trabalho, enviamos avisos de 30, 7 e 1
        dia; atrasos no envio estendem a antecedência. Arquivos têm avisos
        próprios. Cadastros cujo email nunca foi confirmado seguem 12 meses
        desde sua criação na autenticação, com nova conferência antes da
        remoção.
      </p>
      <p>
        Você pode solicitar a exclusão em Minha conta, confirmando sua
        identidade. O acesso é encerrado e as próximas renovações são
        interrompidas. A remoção é processada entre os serviços e pode
        permanecer pendente se um fornecedor falhar. Registros necessários de
        cobrança, aceites e comprovação do pedido seguem conservação seletiva,
        acesso restrito e descarte próprio. Dúvidas sobre os registros da sua
        conta podem ser encaminhadas ao nosso contato.
      </p>
      <p>
        Cancelamento de assinatura e exclusão são distintos. O cancelamento
        interrompe futuras renovações e mantém acesso até o fim do período pago,
        sem remover imediatamente o cadastro.
      </p>
      <h2>Feedback e diagnósticos</h2>
      <p>
        Motivo e comentário são opcionais. Relatos de cancelamento ficam
        vinculados à conta enquanto ela existir para permitir suporte e retorno
        sobre problemas. Na exclusão, normalizamos e desvinculamos também os
        relatos anteriores. Somente descrições padronizadas sem texto
        identificável são conservadas sem prazo final; detalhes que não possam
        ser tratados com segurança são descartados. A consulta é restrita a
        administradores.
      </p>
      <p>
        Diagnósticos de produção têm prazo de 30 dias e acesso administrativo,
        sem senhas, cookies, cartões ou conteúdo pessoal bruto. Registros com
        obrigações próprias, como acesso ou incidentes quando aplicáveis, são
        tratados separadamente.
      </p>
      <h2>Backups e limites de recuperação</h2>
      <p>
        Priorizamos a cópia do banco conforme a cobertura do provedor. Não
        mantemos backup independente de imagens e arquivos nesta fase. Restaurar
        o banco não restaura os bytes dos arquivos e deve reaplicar exclusões e
        normalizações. Não guardamos a imagem original; arquivos removidos podem
        não ser recuperáveis e depender de reenvio por você.
      </p>
      <h2>Seus direitos e contato</h2>
      <p>
        Você pode solicitar confirmação de tratamento, acesso, correção,
        informações sobre compartilhamento, revisão e demais direitos
        aplicáveis, incluindo anonimização, bloqueio ou eliminação quando
        cabíveis. Atendemos pelo email acima, confirmando identidade e
        respeitando os prazos e exceções legais. Não envie senhas; eventual
        entrega de cópia será feita por canal seguro e limitada à sua conta.
      </p>
      <p>
        Se você administra informações de seus clientes e terceiros, deve ter
        autorização e fundamento para inseri-las. Nosso canal também recebe
        dúvidas e solicitações relacionadas a esses dados.
      </p>
      <p>
        Esta versão acompanha o ambiente de testes. Configuração dos
        fornecedores, prazos legais específicos e procedimentos de produção
        serão revisados antes do lançamento. Alterações relevantes serão
        comunicadas pela plataforma ou email, com identificação da nova versão.
      </p>
    </main>
  );
}
export function DeletionReceipt() {
  const raw =
    new URLSearchParams(window.location.search).get("protocolo") ?? "";
  const protocol = /^[0-9a-f-]{36}$/i.test(raw) ? raw : null;
  return (
    <main className="privacy-document">
      <StudioBrand />
      <h1>Recebemos seu pedido de exclusão</h1>
      <p>
        Seu acesso foi encerrado. A exclusão dos dados e a interrupção de
        futuras renovações serão processadas entre os serviços. Este recibo não
        significa que todas as etapas já foram concluídas.
      </p>
      {protocol && (
        <p>
          Protocolo: <strong>{protocol}</strong>
        </p>
      )}
      <p>
        Você receberá a confirmação por email após a conclusão. Se precisar
        acompanhar o pedido, escreva para{" "}
        <a href="mailto:sergastudio@outlook.com">sergastudio@outlook.com</a> e
        informe o protocolo.
      </p>
      <a className="button secondary" href="/login">
        Ir para o login
      </a>
    </main>
  );
}
