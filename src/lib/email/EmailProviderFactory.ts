
import { EmailProvider, EmailProviderName } from "./EmailProvider";
import { GmailProvider } from "./providers/GmailProvider";
import { MicrosoftProvider } from "./providers/MicrosoftProvider";
import { IMAPProvider } from "./providers/IMAPProvider";

/**
 * Returns an instance of the requested email provider.
 */
export function getEmailProvider(provider: EmailProviderName): EmailProvider {
  switch (provider) {
    case "google":
      return new GmailProvider();
    case "microsoft":
      return new MicrosoftProvider();
    case "imap":
      return new IMAPProvider();
    default:
      throw new Error(`Unsupported email provider: ${provider}`);
  }
}
