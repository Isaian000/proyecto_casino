import { Router } from 'express';
import { isLoggedIn } from '../middleware/isLoggedIn';
import {
    sendFriendRequest,
    listFriends,
    listPendingRequests,
    respondFriendRequest,
    removeFriend,
} from '../controllers/friend.controller';

const router = Router();

router.use(isLoggedIn);

router.get('/', listFriends);
router.post('/requests', sendFriendRequest);
router.get('/requests', listPendingRequests);
router.patch('/requests/:id', respondFriendRequest);
router.delete('/:id', removeFriend);

export default router;
