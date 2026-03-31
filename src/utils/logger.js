const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function timestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

const logger = {
  info(message, ...args) {
    console.log(
      `${colors.gray}[${timestamp()}]${colors.reset} ${colors.blue}ℹ INFO${colors.reset}  ${message}`,
      ...args
    );
  },

  success(message, ...args) {
    console.log(
      `${colors.gray}[${timestamp()}]${colors.reset} ${colors.green}✓ OK${colors.reset}    ${message}`,
      ...args
    );
  },

  warn(message, ...args) {
    console.log(
      `${colors.gray}[${timestamp()}]${colors.reset} ${colors.yellow}⚠ WARN${colors.reset}  ${message}`,
      ...args
    );
  },

  error(message, ...args) {
    console.error(
      `${colors.gray}[${timestamp()}]${colors.reset} ${colors.red}✗ ERROR${colors.reset} ${message}`,
      ...args
    );
  },

  deploy(message, ...args) {
    console.log(
      `${colors.gray}[${timestamp()}]${colors.reset} ${colors.magenta}🚀 DEPLOY${colors.reset} ${message}`,
      ...args
    );
  },

  rollback(message, ...args) {
    console.log(
      `${colors.gray}[${timestamp()}]${colors.reset} ${colors.red}↩ ROLLBACK${colors.reset} ${message}`,
      ...args
    );
  },

  metric(message, ...args) {
    console.log(
      `${colors.gray}[${timestamp()}]${colors.reset} ${colors.cyan}📊 METRIC${colors.reset} ${message}`,
      ...args
    );
  },
};

module.exports = logger;
