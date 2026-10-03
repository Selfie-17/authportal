import React from 'react';
import Sidebar from './Sidebar';

/**
 * Re-exports Sidebar as default Navbar to replace the top navbar
 * seamlessly across all authenticated views.
 */
export default function Navbar() {
  return <Sidebar />;
}

export { Sidebar };
