const { Router } = require('express');
const auth = require('../middleware/auth');
const {
  createLocation,
  listLocations,
  updateLocation,
  deleteLocation,
} = require('../controllers/locations.controller');

const router = Router();

router.get('/',    auth, listLocations);
router.post('/',   auth, createLocation);
router.patch('/:id', auth, updateLocation);
router.delete('/:id', auth, deleteLocation);

module.exports = router;
