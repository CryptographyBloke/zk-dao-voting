// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract Groth16Verifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 11703521181751343592777638768980309123294703689602105259130701223782680062150;
    uint256 constant alphay  = 13107202355359600098496668937642818296511068639176186345312664503947568134513;
    uint256 constant betax1  = 2824125432558244113072911495210851791191985240075207869156941013668687678071;
    uint256 constant betax2  = 4499382607807061506934162857853998308223847296494336811023197080465922715329;
    uint256 constant betay1  = 9872100621787816135846143699116208456856143572050569429144757611096982302649;
    uint256 constant betay2  = 9708571997712702172249315749543182379414873762669131389171876961098442010143;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant deltax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant deltay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant deltay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;

    
    uint256 constant IC0x = 21888016307113503942159686029669183775069966280696421894409595006924238878586;
    uint256 constant IC0y = 3209923456587385086648622047250403253725541929126658994618562612536340402318;
    
    uint256 constant IC1x = 16652359875145332842860120578432871584227712864992915533332398264325567247702;
    uint256 constant IC1y = 20263614686973003037436271171494820074537264992910512217262915462403460180301;
    
    uint256 constant IC2x = 2418717558844827995721835406650216740849257186353767634052054241715935428864;
    uint256 constant IC2y = 12738427304785519940252464129597944424978202418512141358500734849926335457460;
    
    uint256 constant IC3x = 12433001691072903884794888194187955669496314720013099402377731412404855364533;
    uint256 constant IC3y = 3062150322305488177145654963518535920368502183071284425707106019674200521797;
    
    uint256 constant IC4x = 3649158820367672365726682305062993533330451913582372053708717483195507518091;
    uint256 constant IC4y = 11780489272035101986504765839741194885812590498218447290658166187854404318381;
    
    uint256 constant IC5x = 701241984041183872259652009730597610303037326510033340404981077646912594941;
    uint256 constant IC5y = 19601405949449713479570782341058338412567814834518100067929359796828854596851;
    
    uint256 constant IC6x = 11070495167081859276208642764320725131101754419341420543892953996201665608422;
    uint256 constant IC6y = 20962959771950742590020923433001356439004157936864884070044165433586258128960;
    
    uint256 constant IC7x = 19619466995062981432303082688836061457847681495660765830632764134468062608732;
    uint256 constant IC7y = 5700796134654520826744188308914690990771479733492690251286020788288964422332;
    
    uint256 constant IC8x = 2930463540793539462876369986599428190793483226378809193610563656118768879246;
    uint256 constant IC8y = 857167239612157725873696232437171770232418426167244990298476073289272913498;
    
    uint256 constant IC9x = 4789387753077860605877018630025982996332212689863117829321917573683711374730;
    uint256 constant IC9y = 7673887312165200911813099439460189375677690130094789378966796529794542978664;
    
    uint256 constant IC10x = 8640768551656359362494891943324200856790045761434719167204720646087036824798;
    uint256 constant IC10y = 14751927868517074502715102786872813878826902498621068286535364133425529124061;
    
    uint256 constant IC11x = 9196297043770545989971735613563867298615970376381112048467800300348476658716;
    uint256 constant IC11y = 8877613171687042762011422824664386173948818164414198337253467331592679778825;
    
    uint256 constant IC12x = 752347992603572564758319973565610200956935131812365885557652524581180356736;
    uint256 constant IC12y = 12534493506159564967858368044091823592903474114497270107970017426411796604965;
    
    uint256 constant IC13x = 2358769108096413009428254367205592781256534007764775530529417857925327451303;
    uint256 constant IC13y = 9512481011214831417362781634044897890114019867424668943330247816785380410824;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[13] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
