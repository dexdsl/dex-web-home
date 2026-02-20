import { writeEntryFromData as writeEntryFromDataCore } from './init-core.mjs';

export async function writeEntryFromData({ templatePath, templateHtml, data, opts = {}, log = () => {} }) {
  const { report, lines } = await writeEntryFromDataCore({
    templatePath,
    templateHtml,
    data,
    opts,
  });

  lines.forEach((line) => log(line));

  return {
    slug: report.slug,
    folder: report.folder,
    html: report.htmlPath,
    template: report.templatePath,
    injectionStrategy: report.injectionStrategy,
    timestamp: report.timestamp,
  };
}
