// src/lib/errors.ts
export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;
  
  constructor(context: SecurityRuleContext) {
    const message = `Firestore Permission Denied: You do not have permission to ${context.operation} the document at '${context.path}'.`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
    
    // This is to make the error object serializable for the Next.js error overlay
    this.message = JSON.stringify({
        message: 'A Firestore Security Rule was violated. See the context below for details.',
        context: this.context
    }, null, 2);
  }
}
