declare global {
  namespace NodeJS {
    interface Global {
      slackApp: any;
    }
  }
}

export {};