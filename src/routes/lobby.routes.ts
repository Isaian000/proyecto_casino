import { Router } from 'express';
import { isLoggedIn } from '../middleware/isLoggedIn';
import {
    createLobby,
    listLobbies,
    joinLobby,
    leaveLobby,
} from '../controllers/lobby.controller';

const router = Router();

router.use(isLoggedIn);

router.get('/', listLobbies);
router.post('/', createLobby);
router.post('/:id/join', joinLobby);
router.post('/:id/leave', leaveLobby);

export default router;
