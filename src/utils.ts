// export const ytDlpCommands = {
//   default: (fileName: string, url: string) =>
//     `yt-dlp --no-warnings -f "h264_540p_461239-0" --merge-output-format mp4 -o "${fileName}" "${url}"`,

//   // default: (fileName: string, url: string) =>
//   //   `yt-dlp --no-warnings -f best --merge-output-format mp4 -o "${fileName}" "${url}"`,

//   analyzeVideo: (url: string) =>
//     `yt-dlp --no-warnings -j --flat-playlist "${url}"`,
// };
// //h264_540p_461239 - шв

export const ytDlpCommands = {
  analyzeVideo: (url: string) => `yt-dlp --no-warnings -j "${url}"`,
  listFormats: (url: string) => `yt-dlp -F "${url}"`,
  default: (fileName: string, url: string, formatId: string) =>
    `yt-dlp --no-warnings -f "${formatId}" --merge-output-format mp4 -o "${fileName}" "${url}"`,
};
