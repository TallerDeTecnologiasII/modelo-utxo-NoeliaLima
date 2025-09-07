import {getUTXOKey, Transaction, TransactionInput} from './types';
import { UTXOPoolManager } from './utxo-pool';
import { verify } from './utils/crypto';
import {
  ValidationResult,
  ValidationError,
  VALIDATION_ERRORS,
  createValidationError
} from './errors';

export class TransactionValidator {
  constructor(private utxoPool: UTXOPoolManager) {}

  /**
   * Validate a transaction
   * @param {Transaction} transaction - The transaction to validate
   * @returns {ValidationResult} The validation result
   */
  validateTransaction(transaction: Transaction): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Asegurar que todas las entradas referencien UTXOs existentes y que las firmas sean válidas
    for (const input of transaction.inputs) {
      const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);

      // Verificar que el UTXO exista
      if (!utxo) {
        // Si no existe, agregar el error
        errors.push(
            createValidationError(
                VALIDATION_ERRORS.UTXO_NOT_FOUND,
                `UTXO not found: ${input.utxoId.txId}:${input.utxoId.outputIndex}`,
                { txId: input.utxoId.txId, outputIndex: input.utxoId.outputIndex }
            )
        );}
      //Si existe, verificar que la firma sea válida
      else{
        const transactionData = this.createTransactionDataForSigning_(transaction);
        const isValidSignature= verify(transactionData, input.signature, input.owner);
        if (!
      isValidSignature) {
          errors.push(
              createValidationError(
                  VALIDATION_ERRORS.INVALID_SIGNATURE,
                  `Invalid signature for input: ${input.utxoId.txId}:${input.utxoId.outputIndex}`,
                  { txId: input.utxoId.txId, outputIndex: input.utxoId.outputIndex }
              )
          );
        }
      }
    }
    
    // Asegurar que ningún UTXO sea referenciado múltiples veces dentro de la misma transacción
    const referencedUTXOs = new Set<string>();
    for (const input of transaction.inputs) {
      const utxoKey = getUTXOKey(input.utxoId);
      if (referencedUTXOs.has(utxoKey)) {
        errors.push(
            createValidationError(
                VALIDATION_ERRORS.DOUBLE_SPENDING,
                `UTXO referenced multiple times: ${utxoKey}`,
                { utxoId: input.utxoId }
            )
        );
      } else {
        referencedUTXOs.add(utxoKey);
      }
    }

    // Asegurar que la suma de montos de entrada igualen la suma de montos de salida
    let totalInputAmount = 0;
    let totalOutputAmount = 0;
    for (const input of transaction.inputs) {
      const utxo = this.utxoPool.getUTXO(input.utxoId.txId, input.utxoId.outputIndex);
      if (utxo) totalInputAmount += utxo.amount;
    }

    for (const output of transaction.outputs) {
      totalOutputAmount += output.amount;
    }
    
    if (totalInputAmount !== totalOutputAmount) {
      errors.push(
          createValidationError(
              VALIDATION_ERRORS.AMOUNT_MISMATCH,
              `Input amount (${totalInputAmount}) does not match output amount (${totalOutputAmount})`,
              { totalInput: totalInputAmount, totalOutput: totalOutputAmount }
          )
      );
    }
    
    // Asegurar que haya al menos una salida 
    if (totalOutputAmount === 0){
        errors.push(
            createValidationError(
                VALIDATION_ERRORS.EMPTY_OUTPUTS,
                `Transaction must have at least one output`,
                { transactionId: transaction.id }
            )
        );
    }

    // Asegurar que no haya montos negativos o cero en las salidas
    for (const output of transaction.outputs) {
      if (output.amount <= 0) {
        errors.push(
            createValidationError(
                VALIDATION_ERRORS.NEGATIVE_AMOUNT,
                `Output amount must be positive: ${output.amount}`,
                { output }
            )
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create a deterministic string representation of the transaction for signing
   * This excludes the signatures to prevent circular dependencies
   * @param {Transaction} transaction - The transaction to create a data for signing
   * @returns {string} The string representation of the transaction for signing
   */
  private createTransactionDataForSigning_(transaction: Transaction): string {
    const unsignedTx = {
      id: transaction.id,
      inputs: transaction.inputs.map(input => ({
        utxoId: input.utxoId,
        owner: input.owner
      })),
      outputs: transaction.outputs,
      timestamp: transaction.timestamp
    };

    return JSON.stringify(unsignedTx);
  }
}
