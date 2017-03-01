import { SlackAppModel } from './slack-app';

declare global {
  namespace NodeJS {
    interface Global {
      slackApp: SlackAppModel;
    }
  }
}

export {};