const DELAY_BEFORE_RELEASING_THE_FILE_MS = 60_000;

export function offerToDownload(content: string, fileName: string, mediaType: string): void {
  const fileUrl = URL.createObjectURL(new Blob([content], { type: mediaType }));
  const link = document.createElement('a');
  link.href = fileUrl;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(fileUrl), DELAY_BEFORE_RELEASING_THE_FILE_MS);
}
