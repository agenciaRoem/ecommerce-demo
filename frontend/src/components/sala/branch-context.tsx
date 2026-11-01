'use client';

import { createContext, useContext } from 'react';

/**
 * Sucursal sobre la que trabaja el panel. Para SALA y GERENTE es `undefined`: el servidor los fija a la suya.
 * Solo el SUPERADMIN (que no pertenece a ninguna) elige una y la envía como `?branchId=`.
 */
const OperatingBranchContext = createContext<string | undefined>(undefined);

export const OperatingBranchProvider = OperatingBranchContext.Provider;
export const useOperatingBranch = () => useContext(OperatingBranchContext);
