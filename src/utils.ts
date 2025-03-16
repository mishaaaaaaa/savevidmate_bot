export const ytDlpCommands = {
  default: (fileName: string, url: string) =>
    `yt-dlp --no-warnings -S ext:mp4:m4a --merge-output-format mp4 -o "${fileName}" "${url}"`,
};
