export const portState = {
  basePort: parseInt(process.env.PORT, 10) || 5001,
  port: null,
  ready: false
};
