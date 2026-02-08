const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Enhanced Storage Migration Manager
 * Provides advanced migration capabilities including cross-format migration,
 * integrity verification, and batch operations
 */
class EnhancedStorageMigrationManager {
  constructor(config, migrationManager, recoveryManager) {
    this.config = config;
    this.migrationManager = migrationManager;
    this.recoveryManager = recoveryManager;
    this.supportedFormats = ['json', 'csv', 'txt', 'xml'];
  }

  /**
   * Migrate data to a different storage format
   */
  async migrateToFormat(todos, sourceFormat, targetFormat, options = {}) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // Create pre-migration backup
      const backupResult = await this.recoveryManager.createManualBackup(
        todos,
        `format-migration-${sourceFormat}-to-${targetFormat}`
      );

      if (!backupResult.success) {
        return {
          success: false,
          error: `Failed to create pre-migration backup: ${backupResult.error}`
        };
      }

      // Generate checksum for source data
      const sourceChecksum = this.generateDataChecksum(todos);

      // Convert to target format
      let convertedData;
      switch (targetFormat) {
        case 'json':
          convertedData = await this.convertToJSON(todos);
          break;
        case 'csv':
          convertedData = await this.convertToCSV(todos);
          break;
        case 'txt':
          convertedData = await this.convertToTXT(todos);
          break;
        case 'xml':
          convertedData = await this.convertToXML(todos);
          break;
        default:
          return {
            success: false,
            error: `Unsupported target format: ${targetFormat}`
          };
      }

      // Save converted data
      const outputPath = path.join(
        this.config.options.dataDir,
        `migrated-${timestamp}.${targetFormat}`
      );

      fs.writeFileSync(outputPath, convertedData);

      // Verify migration integrity
      const verificationResult = await this.verifyMigrationIntegrity(
        todos, outputPath, targetFormat, sourceChecksum
      );

      return {
        success: true,
        sourceFormat,
        targetFormat,
        outputPath,
        backupPath: backupResult.backupPath,
        sourceChecksum,
        targetChecksum: verificationResult.checksum,
        integrityVerified: verificationResult.verified,
        migrationStats: {
          todoCount: todos.length,
          sourceSize: JSON.stringify(todos).length,
          targetSize: convertedData.length,
          compressionRatio: convertedData.length / JSON.stringify(todos).length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Migration failed: ${error.message}`
      };
    }
  }

  /**
   * Batch migrate multiple data files
   */
  async batchMigrate(filePaths, targetFormat, options = {}) {
    const results = [];
    const summary = {
      successful: 0,
      failed: 0,
      totalFiles: filePaths.length
    };

    for (const filePath of filePaths) {
      try {
        // Load data from file
        const data = await this.loadDataFromFile(filePath);
        const sourceFormat = this.detectFormat(filePath);

        // Migrate to target format
        const result = await this.migrateToFormat(data, sourceFormat, targetFormat, options);

        results.push({
          sourceFile: filePath,
          result
        });

        if (result.success) {
          summary.successful++;
        } else {
          summary.failed++;
        }

      } catch (error) {
        results.push({
          sourceFile: filePath,
          result: {
            success: false,
            error: error.message
          }
        });
        summary.failed++;
      }
    }

    return {
      success: summary.failed === 0,
      results,
      summary
    };
  }

  /**
   * Verify migration integrity using checksums
   */
  async verifyMigrationIntegrity(sourceData, targetPath, targetFormat, sourceChecksum) {
    try {
      // Load target data and convert back to source format for comparison
      const targetContent = fs.readFileSync(targetPath, 'utf8');
      let convertedBack;

      switch (targetFormat) {
        case 'json':
          convertedBack = JSON.parse(targetContent);
          break;
        case 'csv':
          convertedBack = await this.convertCSVToJSON(targetContent);
          break;
        case 'txt':
          convertedBack = await this.convertTXTToJSON(targetContent);
          break;
        case 'xml':
          convertedBack = await this.convertXMLToJSON(targetContent);
          break;
        default:
          return { verified: false, error: 'Unsupported format for verification' };
      }

      // Generate checksum for converted data
      const targetChecksum = this.generateDataChecksum(convertedBack);

      // Compare essential data fields (ignoring format-specific differences)
      const verified = this.compareDataIntegrity(sourceData, convertedBack);

      return {
        verified,
        checksum: targetChecksum,
        sourceChecksum,
        targetChecksum
      };

    } catch (error) {
      return {
        verified: false,
        error: error.message
      };
    }
  }

  /**
   * Generate checksum for data integrity verification
   */
  generateDataChecksum(data) {
    // Normalize data for consistent checksums
    const normalized = data.map(todo => ({
      id: todo.id,
      description: todo.description.trim(),
      completed: Boolean(todo.completed),
      priority: todo.priority || 'medium',
      tags: (todo.tags || []).sort()
    })).sort((a, b) => a.id - b.id);

    return crypto.createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  /**
   * Compare data integrity between source and converted data
   */
  compareDataIntegrity(source, target) {
    if (source.length !== target.length) {
      return false;
    }

    const sourceNormalized = source.sort((a, b) => a.id - b.id);
    const targetNormalized = target.sort((a, b) => a.id - b.id);

    for (let i = 0; i < sourceNormalized.length; i++) {
      const s = sourceNormalized[i];
      const t = targetNormalized[i];

      if (s.id !== t.id ||
          s.description.trim() !== t.description.trim() ||
          Boolean(s.completed) !== Boolean(t.completed)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Convert todos to JSON format
   */
  async convertToJSON(todos) {
    return JSON.stringify({
      version: '1.3.0',
      exportDate: new Date().toISOString(),
      migrationInfo: {
        source: 'enhanced-migration-manager',
        format: 'json'
      },
      todos: todos
    }, null, 2);
  }

  /**
   * Convert todos to CSV format
   */
  async convertToCSV(todos) {
    const headers = ['ID', 'Description', 'Completed', 'Priority', 'Tags', 'Created At', 'Due Date'];
    const rows = [headers.join(',')];

    for (const todo of todos) {
      const row = [
        todo.id,
        `"${todo.description.replace(/"/g, '""')}"`,
        todo.completed ? 'Yes' : 'No',
        todo.priority || 'medium',
        `"${(todo.tags || []).join(', ')}"`,
        todo.createdAt || '',
        todo.dueDate || ''
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Convert todos to plain text format
   */
  async convertToTXT(todos) {
    const lines = [
      '# Todo List Export',
      `# Generated: ${new Date().toISOString()}`,
      `# Total todos: ${todos.length}`,
      ''
    ];

    for (const todo of todos) {
      const status = todo.completed ? '[✓]' : '[ ]';
      const priority = todo.priority ? `(${todo.priority.toUpperCase()})` : '';
      const tags = todo.tags && todo.tags.length > 0 ? `#${todo.tags.join(' #')}` : '';

      lines.push(`${status} ${todo.description} ${priority} ${tags}`.trim());

      if (todo.dueDate) {
        lines.push(`    Due: ${new Date(todo.dueDate).toLocaleDateString()}`);
      }

      if (todo.createdAt) {
        lines.push(`    Created: ${new Date(todo.createdAt).toLocaleDateString()}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Convert todos to XML format
   */
  async convertToXML(todos) {
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<todolist>',
      `  <metadata>`,
      `    <version>1.3.0</version>`,
      `    <exportDate>${new Date().toISOString()}</exportDate>`,
      `    <todoCount>${todos.length}</todoCount>`,
      `  </metadata>`,
      '  <todos>'
    ];

    for (const todo of todos) {
      lines.push('    <todo>');
      lines.push(`      <id>${todo.id}</id>`);
      lines.push(`      <description><![CDATA[${todo.description}]]></description>`);
      lines.push(`      <completed>${todo.completed}</completed>`);
      lines.push(`      <priority>${todo.priority || 'medium'}</priority>`);

      if (todo.tags && todo.tags.length > 0) {
        lines.push('      <tags>');
        for (const tag of todo.tags) {
          lines.push(`        <tag>${tag}</tag>`);
        }
        lines.push('      </tags>');
      }

      if (todo.createdAt) {
        lines.push(`      <createdAt>${todo.createdAt}</createdAt>`);
      }

      if (todo.dueDate) {
        lines.push(`      <dueDate>${todo.dueDate}</dueDate>`);
      }

      lines.push('    </todo>');
    }

    lines.push('  </todos>');
    lines.push('</todolist>');

    return lines.join('\n');
  }

  /**
   * Convert CSV back to JSON for verification
   */
  async convertCSVToJSON(csvContent) {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    const todos = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const todo = {
        id: parseInt(values[0]),
        description: values[1].replace(/^"|"$/g, '').replace(/""/g, '"'),
        completed: values[2] === 'Yes',
        priority: values[3] || 'medium',
        tags: values[4] ? values[4].replace(/^"|"$/g, '').split(', ').filter(tag => tag) : [],
        createdAt: values[5] || undefined,
        dueDate: values[6] || undefined
      };

      if (todo.description) {
        todos.push(todo);
      }
    }

    return todos;
  }

  /**
   * Parse CSV line handling quoted values
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  }

  /**
   * Convert TXT back to JSON for verification
   */
  async convertTXTToJSON(txtContent) {
    const lines = txtContent.split('\n');
    const todos = [];
    let currentTodo = null;
    let idCounter = 1;

    for (const line of lines) {
      if (line.startsWith('[') && (line.includes('✓') || line.includes(' '))) {
        // Process previous todo if exists
        if (currentTodo) {
          todos.push(currentTodo);
        }

        // Start new todo
        const completed = line.includes('✓');
        const description = line.replace(/^\[.\]\s*/, '').replace(/\(.*?\)/g, '').replace(/#\w+/g, '').trim();
        const priorityMatch = line.match(/\((\w+)\)/);
        const priority = priorityMatch ? priorityMatch[1].toLowerCase() : 'medium';
        const tagMatches = line.match(/#(\w+)/g);
        const tags = tagMatches ? tagMatches.map(tag => tag.substring(1)) : [];

        currentTodo = {
          id: idCounter++,
          description,
          completed,
          priority,
          tags,
          createdAt: new Date().toISOString()
        };
      }
    }

    // Add final todo
    if (currentTodo) {
      todos.push(currentTodo);
    }

    return todos;
  }

  /**
   * Convert XML back to JSON for verification (simplified)
   */
  async convertXMLToJSON(xmlContent) {
    // Simplified XML parsing - in production you'd use a proper XML parser
    const todos = [];
    const todoMatches = xmlContent.match(/<todo>[\s\S]*?<\/todo>/g) || [];

    for (let i = 0; i < todoMatches.length; i++) {
      const todoXml = todoMatches[i];
      const id = this.extractXMLValue(todoXml, 'id');
      const description = this.extractXMLCData(todoXml, 'description');
      const completed = this.extractXMLValue(todoXml, 'completed') === 'true';
      const priority = this.extractXMLValue(todoXml, 'priority') || 'medium';
      const createdAt = this.extractXMLValue(todoXml, 'createdAt');
      const dueDate = this.extractXMLValue(todoXml, 'dueDate');

      // Extract tags
      const tagsMatch = todoXml.match(/<tags>([\s\S]*?)<\/tags>/);
      const tags = [];
      if (tagsMatch) {
        const tagMatches = tagsMatch[1].match(/<tag>([^<]+)<\/tag>/g) || [];
        for (const tagMatch of tagMatches) {
          const tag = tagMatch.replace(/<\/?tag>/g, '');
          tags.push(tag);
        }
      }

      if (description) {
        todos.push({
          id: parseInt(id) || i + 1,
          description,
          completed,
          priority,
          tags,
          createdAt,
          dueDate
        });
      }
    }

    return todos;
  }

  /**
   * Extract value from XML tag
   */
  extractXMLValue(xml, tagName) {
    const match = xml.match(new RegExp(`<${tagName}>([^<]*)</${tagName}>`));
    return match ? match[1] : '';
  }

  /**
   * Extract CDATA value from XML tag
   */
  extractXMLCData(xml, tagName) {
    const match = xml.match(new RegExp(`<${tagName}><\\!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tagName}>`));
    return match ? match[1] : this.extractXMLValue(xml, tagName);
  }

  /**
   * Detect format from file path
   */
  detectFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.json': return 'json';
      case '.csv': return 'csv';
      case '.txt': return 'txt';
      case '.xml': return 'xml';
      default: return 'json';
    }
  }

  /**
   * Load data from file
   */
  async loadDataFromFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const format = this.detectFormat(filePath);

    switch (format) {
      case 'json':
        const parsed = JSON.parse(content);
        return parsed.todos || parsed; // Handle both wrapped and unwrapped formats
      case 'csv':
        return await this.convertCSVToJSON(content);
      case 'txt':
        return await this.convertTXTToJSON(content);
      case 'xml':
        return await this.convertXMLToJSON(content);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Get migration statistics
   */
  getMigrationStats() {
    const dataDir = this.config.options.dataDir;
    const files = fs.readdirSync(dataDir);

    const stats = {
      totalMigrations: 0,
      formatMigrations: 0,
      versionMigrations: 0,
      backupsCreated: 0,
      formats: {}
    };

    for (const file of files) {
      if (file.startsWith('migrated-')) {
        stats.formatMigrations++;
        const format = path.extname(file).substring(1);
        stats.formats[format] = (stats.formats[format] || 0) + 1;
      }

      if (file.startsWith('migration-backup-')) {
        stats.versionMigrations++;
      }

      if (file.includes('backup')) {
        stats.backupsCreated++;
      }
    }

    stats.totalMigrations = stats.formatMigrations + stats.versionMigrations;

    return stats;
  }
}

module.exports = { EnhancedStorageMigrationManager };