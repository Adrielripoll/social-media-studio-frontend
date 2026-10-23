interface UploadFailure {
  originalResponse?: { getStatus(): number } | null;
}
export function videoUploadError(error: unknown): string {
  const failure = error as UploadFailure | null;
  const status = failure?.originalResponse?.getStatus?.() ?? 0;
  switch (status) {
    case 413:
      return "Este vídeo excede o tamanho aceito pelo armazenamento. Reduza o arquivo antes de enviar novamente.";
    case 401:
    case 403:
      return "A autorização de envio expirou ou não foi aceita. Selecione o vídeo novamente para iniciar outro envio.";
    case 404:
    case 410:
      return "Este envio não está mais disponível. Selecione o vídeo novamente.";
    case 415:
      return "O armazenamento não aceitou este formato. Envie um vídeo MP4, MOV, AVI, MKV ou WMV.";
    case 429:
      return "Há muitos envios em pouco tempo. Aguarde um minuto antes de tentar novamente.";
    case 0:
      return "O envio foi interrompido. Confira sua conexão e selecione o vídeo novamente.";
    default:
      return "O armazenamento não conseguiu receber o vídeo agora. Aguarde um pouco e tente novamente.";
  }
}
