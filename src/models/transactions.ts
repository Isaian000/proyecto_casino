import { Schema, model, Document, Types } from 'mongoose';

export type TransactionType = 'bet' | 'win' | 'deposit' | 'withdrawal' | 'refund';
export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface ITransaction extends Document {
    user: Types.ObjectId;
    type: TransactionType;
    amount: number;
    balanceAfter: number;
    game?: string;
    lobbyId?: string;
    status: TransactionStatus;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ['bet', 'win', 'deposit', 'withdrawal', 'refund'],
            required: true,
        },
        amount: { type: Number, required: true },
        balanceAfter: { type: Number, required: true },
        game: { type: String },
        lobbyId: { type: String },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'completed',
        },
        metadata: { type: Schema.Types.Mixed },
    },
    { timestamps: true }
);

export default model<ITransaction>('Transaction', transactionSchema);
