export default {
  stacks: async (app: any) => {
    const { AppStack } = await import("./infra/stacks/AppStack.js");
    app.stack(AppStack);
  },
};