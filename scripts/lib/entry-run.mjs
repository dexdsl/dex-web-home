import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { detectTemplateProblems, extractFormatKeys, injectEntryHtml } from './entry-html.mjs';
import { entrySchema, formatZodError, manifestSchemaForFormats, sidebarConfigSchema } from './entry-schema.mjs';

export async function writeEntryFromData({ templatePath, templateHtml, data, opts = {}, log = () => {} }) {
  const missing = detectTemplateProblems(templateHtml);
  if (missing.length) throw new Error(`Template validation failed; missing: ${missing.join(', ')}`);

  const formatKeys = extractFormatKeys(templateHtml);

  try { sidebarConfigSchema.parse(data.sidebar); } catch (e) { throw new Error(formatZodError(e, 'Sidebar config (wizard step)')); }
  try { manifestSchemaForFormats(formatKeys.audio, formatKeys.video).parse(data.manifest); } catch (e) { throw new Error(formatZodError(e, 'Manifest (wizard step)')); }
  try { entrySchema.parse({ slug: data.slug, title: data.title, video: data.video, sidebarPageConfig: data.sidebar }); } catch (e) { throw new Error(formatZodError(e, 'Entry data')); }

  const injected = injectEntryHtml(templateHtml, {
    descriptionHtml: data.descriptionHtml,
    manifest: data.manifest,
    sidebarConfig: data.sidebar,
    video: data.video,
    title: data.title,
    authEnabled: data.authEnabled,
  });

  const folder = opts.flat ? path.join(path.resolve('.'), data.slug) : path.join(data.outDir, data.slug);
  const files = {
    html: path.join(folder, 'index.html'),
    entry: path.join(folder, 'entry.json'),
    desc: path.join(folder, 'description.html'),
    manifest: path.join(folder, 'manifest.json'),
  };

  log(`slug: ${data.slug}`);
  log(`output folder: ${folder}`);
  log(`template: ${templatePath}`);
  log(`injection strategy: video=${injected.strategy.video}, description=${injected.strategy.description}, sidebar=${injected.strategy.sidebar}`);

  if (opts.dryRun) {
    log(`[dry-run] would write: ${JSON.stringify(files)}`);
    return {
      slug: data.slug,
      folder,
      html: files.html,
      template: templatePath,
      injectionStrategy: injected.strategy,
      timestamp: new Date().toISOString(),
    };
  }

  await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(files.html, injected.html, 'utf8');
  await fs.writeFile(files.entry, `${JSON.stringify({ slug: data.slug, title: data.title, video: data.video, sidebarPageConfig: data.sidebar }, null, 2)}\n`, 'utf8');
  await fs.writeFile(files.desc, `${data.descriptionHtml.trim()}\n`, 'utf8');
  await fs.writeFile(files.manifest, `${JSON.stringify(data.manifest, null, 2)}\n`, 'utf8');

  if (opts.open) {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', files.html] : [files.html];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  }

  return {
    slug: data.slug,
    folder,
    html: files.html,
    template: templatePath,
    injectionStrategy: injected.strategy,
    timestamp: new Date().toISOString(),
  };
}
