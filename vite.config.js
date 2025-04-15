import { defineConfig } from "vite";
import fs from 'fs';
import path from 'path';

function getHtmlInputs(directories = []) {
  const inputs = {
    main: path.resolve(__dirname, 'index.html'),
  };

  directories.forEach(dir => {
    const walk = (dirPath) => {
      const files = fs.readdirSync(dirPath);

      files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath); // recurse into subfolder
        } else if (file.endsWith('.html')) {
          // Create a unique name (without extension) using relative path
          const relativePath = path.relative(__dirname, fullPath);
          const key = relativePath.replace(/\.html$/, '').replace(/\\/g, '/'); // Windows-safe

          inputs[key] = fullPath;
        }
      });
    };

    const fullDir = path.resolve(__dirname, dir);
    if (fs.existsSync(fullDir)) {
      walk(fullDir);
    }
  });

  return inputs;
}

export default defineConfig({
  root: "./", // Default root, adjust if needed
  publicDir: "public", // Serve static files
  build: {
    rollupOptions: {
      input: getHtmlInputs(['landing_pages']), // 👈 you can include as many folders as needed
    },
  },
});
