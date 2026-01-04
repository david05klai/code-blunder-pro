import JSZip from 'jszip';
import { ProcessedFile, ProcessingResult, OutputFormat, AITemplate } from '../types';

// Filtros mejorados para ahorrar espacio y tokens
const IGNORED_DIRECTORIES = ['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'vendor', '__pycache__', 'env', 'venv', '.expo', '.vercel'];
const IGNORED_FILES = ['.DS_Store', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.env.local', 'thumbs.db'];

// Estimación de tokens (aprox 4 caracteres por token)
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    'js': 'javascript', 'ts': 'typescript', 'tsx': 'typescript-react', 'jsx': 'javascript-react',
    'py': 'python', 'java': 'java', 'go': 'go', 'rs': 'rust', 'rb': 'ruby', 'php': 'php',
    'html': 'html', 'css': 'css', 'json': 'json', 'yaml': 'yaml', 'md': 'markdown'
  };
  return map[ext] || 'text';
}

function isBinaryFile(path: string): boolean {
  const binExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.pdf', '.zip', '.exe', '.dll', '.woff', '.woff2'];
  return binExts.some(ext => path.toLowerCase().endsWith(ext));
}

export async function loadZipFiles(file: File | Blob): Promise<ProcessedFile[]> {
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  const files: ProcessedFile[] = [];

  for (const [path, zipFile] of Object.entries(content.files)) {
    if (zipFile.dir || IGNORED_DIRECTORIES.some(d => path.includes(d)) || IGNORED_FILES.some(f => path.endsWith(f)) || isBinaryFile(path)) continue;
    
    const text = await zipFile.async('string');
    files.push({
      path,
      content: text,
      size: text.length,
      selected: true,
      language: getLanguage(path),
      lines: text.split('\n').length,
      tokens: estimateTokens(text)
    });
  }
  return files;
}

export function generateTree(paths: string[]): string {
  const tree: any = {};
  paths.forEach(path => {
    let current = tree;
    path.split('/').forEach(part => {
      if (!current[part]) current[part] = {};
      current = current[part];
    });
  });

  const render = (obj: any, prefix = ''): string => {
    const keys = Object.keys(obj);
    return keys.map((key, i) => {
      const isLast = i === keys.length - 1;
      return `${prefix}${isLast ? '└── ' : '├── '}${key}\n${render(obj[key], prefix + (isLast ? '    ' : '│   '))}`;
    }).join('');
  };
  return render(tree);
}

export function generateBundle(files: ProcessedFile[], format: OutputFormat, template: AITemplate, archiveName: string): ProcessingResult {
  const selected = files.filter(f => f.selected);
  const treeStr = generateTree(selected.map(f => f.path));
  let bundleText = "";

  // Plantillas optimizadas
  const prompts = {
    none: "",
    claude: `<context>\nProject: ${archiveName}\nStructure:\n${treeStr}\n</context>\n\n`,
    chatgpt: `Codebase: ${archiveName}\nStructure:\n${treeStr}\nFiles follow:\n\n`,
    gemini: `System: Use this code as context for ${archiveName}.\nStructure:\n${treeStr}\n\n`
  };

  bundleText += prompts[template];

  if (format === 'json') {
    bundleText += JSON.stringify({ project: archiveName, files: selected.map(f => ({ p: f.path, c: f.content })) });
  } else {
    selected.forEach(f => {
      bundleText += format === 'md' 
        ? `### File: ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\`\n\n`
        : `\nFILE: ${f.path}\n${'='.repeat(40)}\n${f.content}\n`;
    });
  }

  return {
    totalFiles: selected.length,
    totalSize: selected.reduce((a, b) => a + b.size, 0),
    totalTokens: estimateTokens(bundleText),
    bundleText,
    files: selected,
    tree: treeStr,
    stats: {
      languages: selected.reduce((acc: any, f) => { acc[f.language] = (acc[f.language] || 0) + 1; return acc; }, {}),
      totalLines: selected.reduce((a, b) => a + b.lines, 0)
    }
  };
}

// ... Mantener reverseBundle y fetchGithubRepo igual o simplificados

export async function reverseBundle(text: string): Promise<Blob> {
  const zip = new JSZip();
  
  // Regex para encontrar archivos en formato TXT
  const fileRegex = /={80}\nFILE: (.*?)\n={80}\n\n([\s\S]*?)(?=\n={80}|$)/g;
  let match;
  const sections: {path: string, content: string}[] = [];

  while ((match = fileRegex.exec(text)) !== null) {
    sections.push({ 
      path: match[1].trim(), 
      content: match[2].trim() 
    });
  }

  // Si no encontró archivos en formato TXT, intentar JSON
  if (sections.length === 0) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.files && Array.isArray(parsed.files)) {
        parsed.files.forEach((f: any) => {
          if (f.path && f.content) {
            zip.file(f.path, f.content);
          }
        });
        return await zip.generateAsync({ type: 'blob' });
      }
    } catch(e) {
      // Intentar formato Markdown
      const mdRegex = /### File: (.*?)\n\n```[\w-]*\n([\s\S]*?)```/g;
      let mdMatch;
      
      while ((mdMatch = mdRegex.exec(text)) !== null) {
        sections.push({ 
          path: mdMatch[1].trim(), 
          content: mdMatch[2].trim() 
        });
      }
    }
  }

  if (sections.length === 0) {
    throw new Error(
      "No se encontraron archivos en el texto.\n\n" +
      "Formatos soportados:\n" +
      "- TXT: ======== FILE: path ========\n" +
      "- Markdown: ### File: path\n" +
      "- JSON: {\"files\": [{\"path\": \"...\", \"content\": \"...\"}]}"
    );
  }

  sections.forEach(s => zip.file(s.path, s.content));
  return await zip.generateAsync({ type: 'blob' });
}

export async function fetchGithubRepo(url: string): Promise<Blob> {
  let cleanUrl = url.trim();
  cleanUrl = cleanUrl.replace(/^https?:\/\//, '');
  cleanUrl = cleanUrl.replace(/^github\.com\//, '');
  cleanUrl = cleanUrl.replace(/\/$/, '');
  
  const parts = cleanUrl.split('/');
  
  if (parts.length < 2) {
    throw new Error("URL inválida. Formato correcto: github.com/usuario/repositorio");
  }
  
  const user = parts[0];
  const repo = parts[1];
  
  // NUEVA ESTRATEGIA: Usar API de GitHub con diferentes proxies
  const proxies = [
    // Proxy 1: allorigins
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://codeload.github.com/${user}/${repo}/zip/refs/heads/main`)}`,
    // Proxy 2: con master
    `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://codeload.github.com/${user}/${repo}/zip/refs/heads/master`)}`,
    // Proxy 3: corsproxy-io alternativo
    `https://proxy.cors.sh/${encodeURIComponent(`https://codeload.github.com/${user}/${repo}/zip/refs/heads/main`)}`,
  ];
  
  for (const proxyUrl of proxies) {
    try {
      console.log(`Intentando descargar con: ${proxyUrl.substring(0, 50)}...`);
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/zip',
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        
        // Verificar que sea un ZIP válido (magic number: 50 4B)
        if (blob.size > 100) {
          console.log(`✅ Descarga exitosa: ${blob.size} bytes`);
          return blob;
        }
      }
    } catch (err) {
      console.error(`❌ Fallo con proxy:`, err);
      continue;
    }
  }
  
  throw new Error(
    "❌ No se pudo descargar el repositorio\n\n" +
    "🔧 Soluciones:\n" +
    "1. Verifica que el repo sea PÚBLICO\n" +
    "2. Intenta con el modo 'Bundle ZIP' descargando manualmente\n" +
    "3. Descarga el ZIP desde GitHub:\n" +
    `   https://github.com/${user}/${repo}/archive/refs/heads/main.zip\n\n` +
    "⚠️ Algunos navegadores/redes bloquean proxies externos"
  );
}
