export default {
  stacks: async (app) => {
    const { AppStack } = await import("./stacks/AppStack.js");
    app.stack(AppStack);
  },
};