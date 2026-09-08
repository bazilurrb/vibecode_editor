interface TemplateItem {
  filename: string;
  fileExtension: string;
  content: string;
  folderName?: string;
  items?: TemplateItem[];
}

interface WebContainerFile {
  file: {
    contents: string;
  };
}

interface WebContainerDirectory {
  directory: {
    [key: string]: WebContainerFile | WebContainerDirectory;
  };
}

type WebContainerFileSystem = Record<string, WebContainerFile | WebContainerDirectory>;

function getItemKey(item: TemplateItem): string {
  if (item.folderName) {
    return item.folderName;
  }
  return item.filename + (item.fileExtension ? `.${item.fileExtension}` : "");
}

export function transformToWebContainerFormat(template: { folderName: string; items: TemplateItem[] }): WebContainerFileSystem {
  function processItem(item: TemplateItem): WebContainerFile | WebContainerDirectory {
    if (item.folderName && item.items) {
      // This is a directory
      const directoryContents: WebContainerFileSystem = {};
      
      item.items.forEach(subItem => {
        const key = getItemKey(subItem);
        directoryContents[key] = processItem(subItem);
      });

      return {
        directory: directoryContents
      };
    } else {
      // This is a file
      return {
        file: {
          contents: item.content
        }
      };
    }
  }

  const result: WebContainerFileSystem = {};
  
  template.items.forEach(item => {
    const key = getItemKey(item);
    result[key] = processItem(item);
  });

  return result;
}