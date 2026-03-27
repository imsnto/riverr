
import { EmailProvider } from "./EmailProvider";
import { EmailProviderName } from "@/lib/data";
import { GmailProvider } from "./providers/GmailProvider";
import { MicrosoftProvider } from "./providers/MicrosoftProvider";


/**
 * Returns an instance of the requested email provider.
 */
export function getEmailProvider(provider: EmailProviderName): EmailProvider {
  switch (provider) {
    case "google":
      return new GmailProvider();
    case "microsoft":
      return new MicrosoftProvider();

    default:
      throw new Error(`Unsupported email provider: ${provider}`);
  }
}
