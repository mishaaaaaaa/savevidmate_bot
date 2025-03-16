export const ytDlpCommands = {
  analyzeVideo: (url: string) => `yt-dlp --no-warnings -j "${url}"`,
  listFormats: (url: string) => `yt-dlp -F "${url}"`,
  download: (fileName: string, url: string, formatId?: string) =>
    formatId
      ? `yt-dlp --no-warnings -f "${formatId}" --merge-output-format mp4 -o "${fileName}" "${url}"`
      : `yt-dlp --no-warnings -f best --merge-output-format mp4 -o "${fileName}" "${url}"`,
};
