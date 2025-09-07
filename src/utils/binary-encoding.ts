import { Transaction, TransactionInput, TransactionOutput } from '../types';

/**
 * Encode a transaction to binary format for space-efficient storage
 * @param {Transaction} transaction - The transaction to encode
 * @returns {Buffer} The binary representation
 */
export function encodeTransaction(transaction: Transaction): Buffer {
  const buffers: Buffer[] = [];
  // Agregar el ID de la transacción
  writeString(transaction.id, buffers);
  
  //Agregar el timestamp de la transaccion en 8 bytes
  const timeStamp = Buffer.alloc(8);
  timeStamp.writeBigUInt64BE(BigInt(transaction.timestamp));
  buffers.push(timeStamp);

  // Agregar la cantidad de inputs
  const inputsAmount= Buffer.alloc(1); 
  inputsAmount.writeUInt8(transaction.inputs.length);
  buffers.push(inputsAmount);

  // Agregar datos del input: utxoId, outputIndex, owner y signature
  for (const input of transaction.inputs) {
    writeString(input.utxoId.txId, buffers);
    const outputIndexBuffer = Buffer.alloc(4);
    outputIndexBuffer.writeUInt32BE(input.utxoId.outputIndex);
    buffers.push(outputIndexBuffer);
    writeString(input.owner, buffers);
    writeString(input.signature, buffers);
  }
  
  // Agregar la cantidad de outputs
  const outputsAmount = Buffer.alloc(1);
  outputsAmount.writeUInt8(transaction.outputs.length);
  buffers.push(outputsAmount);

  // Agregar datos del output: amount y recipient
  for (const output of transaction.outputs) {
    const outputAmountBuffer = Buffer.alloc(8);
    outputAmountBuffer.writeBigUInt64BE(BigInt(output.amount));
    buffers.push(outputAmountBuffer);
    writeString(output.recipient, buffers);
  }
 
  // Concatenar todos los buffers en uno solo y retornarlo
  return Buffer.concat(buffers);
}

// Funcion para escribir en el buffer un string con su longitud
function writeString(string: string, buffers: Buffer[]) {
  // Convertir el string a bytes 
  const stringBytes = Buffer.from(string, 'utf8');
  // Crear buffer de 2 bytes para la longitud del string
  const stringLengthBuf = Buffer.alloc(2);
  //Escribir la longitud en 2 bytes, y despues el string
  stringLengthBuf.writeUInt16BE(stringBytes.length); 
  buffers.push(stringLengthBuf, stringBytes);
}

/**
 * Decode a transaction from binary format
 * @param {Buffer} buffer - The binary data to decode
 * @returns {Transaction} The reconstructed transaction object
 */
export function decodeTransaction(buffer: Buffer): Transaction {
  let readPosition = 0;
  
  //Leer ID de la transaccion 
  let id: string;
  [id, readPosition] = readString(buffer, readPosition);
  
  //Leer timestamp
  const timeStamp = Number(buffer.readBigUInt64BE(readPosition));
  readPosition += 8;
  
  // Obtener cantidad de inputs de la transaccion 
  const inputsAmount = buffer.readUInt8(readPosition++);
  const inputs: TransactionInput[] = [];

  // Por cada input se obtiene el txId, el outputIndex, el owner y la signature
  for (let i = 0; i < inputsAmount; i++) {
    let txId: string;
    [txId, readPosition] = readString(buffer, readPosition);
    const outputIndex = buffer.readUInt32BE(readPosition);
    readPosition += 4;
    let owner: string;
    [owner, readPosition] = readString(buffer, readPosition);
    let signature: string;
    [signature, readPosition] = readString(buffer, readPosition);
    inputs.push({ utxoId: { txId, outputIndex }, owner, signature });
  }
 
    // Obtener cantidad de outputs de la transaccion
  const outputsAmount = buffer.readUInt8(readPosition++);
  const outputs: TransactionOutput[] = [];

  // Leer datos del output: amount y recipient
  for (let i = 0; i < outputsAmount; i++) {
    const amount = Number(buffer.readBigUInt64BE(readPosition));
    readPosition += 8;
    let recipient: string;
    [recipient, readPosition] = readString(buffer, readPosition);
    outputs.push({ amount, recipient });
  }

  // Retornar la transaccion reconstruida 
  return { id, timestamp: timeStamp, inputs, outputs };
}

// Funcion para leer del buffer un string con su longitud
function readString(buffer: Buffer, offset: number): [string, number] {
  // Obtener el tamano del string 
  const stringLength = buffer.readUInt16BE(offset);
  offset += 2;
  // Extraer los bytes del string y convertir a UTF-8
  const string = buffer.slice(offset, offset + stringLength).toString('utf8');
  offset += stringLength;
  return [string, offset];
}



/**
 * Compare encoding efficiency between JSON and binary representations
 * @param {Transaction} transaction - The transaction to analyze
 * @returns {object} Size comparison and savings information
 */
export function getEncodingEfficiency(transaction: Transaction): {
  jsonSize: number;
  binarySize: number;
  savings: string;
} {
  const jsonSize = Buffer.from(JSON.stringify(transaction)).length;
  try {
    const binarySize = encodeTransaction(transaction).length;
    const savingsPercent = (((jsonSize - binarySize) / jsonSize) * 100).toFixed(1);
    return {
      jsonSize,
      binarySize,
      savings: `${savingsPercent}%`
    };
  } catch {
    return {
      jsonSize,
      binarySize: -1,
      savings: 'Not implemented'
    };
  }
}
