export default {
  stacks: async (app) => {
    const { AppStack } = await import("./infra/stacks/AppStack.js");
    app.stack(AppStack);
  },
};