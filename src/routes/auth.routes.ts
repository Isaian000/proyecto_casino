import { Router } from 'express';
import { registerUser, loginUser, deleteAccount } from '../controllers/auth.controller';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.delete('/delete-account', deleteAccount);

export default router;