
'use server';

/**
 * @fileOverview Server action to verify DNS records for custom domains.
 */

import dns from 'dns/promises';

export type DnsVerificationResult = {
  success: boolean;
  error?: string;
  records?: string[];
};

/**
 * Verifies if a domain has a CNAME record pointing to the Manowar proxy.
 */
export async function verifyCustomDomainDns(domain: string): Promise<DnsVerificationResult> {
  if (!domain) {
    return { success: false, error: 'No domain provided' };
  }

  // Clean the domain (strip protocol and paths)
  const hostname = domain
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .trim();

  if (!hostname) {
    return { success: false, error: 'Invalid hostname' };
  }

  try {
    // Resolve CNAME records
    const records = await dns.resolveCname(hostname);
    
    // Check if any of the records point to the expected proxy
    const expectedProxy = 'proxy.manowar.cloud';
    const isValid = records.some(r => r.toLowerCase() === expectedProxy);

    return { 
      success: isValid, 
      records,
      error: isValid ? undefined : `Domain points to ${records.join(', ')} instead of ${expectedProxy}`
    };
  } catch (error: any) {
    // Handle cases where no CNAME exists
    if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
      return { success: false, error: 'No CNAME record found for this domain.' };
    }
    
    console.error('DNS verification error:', error);
    return { success: false, error: 'Could not resolve DNS records. Please try again later.' };
  }
}
