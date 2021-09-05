import Api from './api';
import Bot from './bot';
import Nuxt from './nuxt';

export default class Tesseract {
  public bot: Bot;
  public api: Api;
  public nuxt: Nuxt;

  constructor() {
    this.bot = new Bot();
    this.api = new Api();
    this.nuxt = new Nuxt();

    this.init();
  }

  async init(): Promise<void> {
    await Promise.all([
      // eslint-disable-next-line
      this.api.start(),
      this.nuxt.start(),
      this.bot.start()
    ]);
  }
}
