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

contract TallyVerifier {
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

    
    uint256 constant IC0x = 2272279357157893405161553729444467922454444649282880710911103644696720163552;
    uint256 constant IC0y = 6903631337822542203573657888842822098142859466146140128078686681641821617500;
    
    uint256 constant IC1x = 10820883147247769905210647972850583892811808343347681107651274356149613723447;
    uint256 constant IC1y = 14468108593722587542193895334040449096382186079155177530534832729643312395168;
    
    uint256 constant IC2x = 5374303463691248210773246308576953752586003634435723590209776253974844963428;
    uint256 constant IC2y = 21288800311113963320797272801024622273569906525027653443596070135861771241277;
    
    uint256 constant IC3x = 5407234347368905787145443217580977696606644254775329948215834225003740100287;
    uint256 constant IC3y = 19601404967448945655124058209673113256245988298304855371230687114806745613601;
    
    uint256 constant IC4x = 9564270048376862392913378605623087285394400133491771532273537666887504447282;
    uint256 constant IC4y = 18577678126890961308913823407813926584465119488553275330746482836172763392211;
    
    uint256 constant IC5x = 6834709881078773311470284400079253081266117683501720484143545510065322295641;
    uint256 constant IC5y = 3212964657642438712058276564127727441450208268788561199634547686590256753601;
    
    uint256 constant IC6x = 12048815039969342998492035969085211746562845612658282125754348611647318889880;
    uint256 constant IC6y = 667332625102547794147616289149679786933086258448404062473335671171164783045;
    
    uint256 constant IC7x = 8083304682256357952706796069770263884049994517425706545089261748390876603717;
    uint256 constant IC7y = 9577930170651737143235282481660469497841839938154556156847080981949154283054;
    
    uint256 constant IC8x = 9185234588354563830052642035677347755273967396624806970763449683256522199534;
    uint256 constant IC8y = 7018422286862881946122900600145089470471334552273906340868335892276604506464;
    
    uint256 constant IC9x = 17712700366827597818738463404622970667233151707549260744365727608049245348888;
    uint256 constant IC9y = 4810911625711938552321680206055891385926384035077428391489663357149245033179;
    
    uint256 constant IC10x = 3615149359752075580603584271417209235072286799235971051181386928216034346419;
    uint256 constant IC10y = 4819867981556233281762099105956947091748884937170179429370424719702860449524;
    
    uint256 constant IC11x = 10096343041249014834943468654328053371705542638929421816461967180362901594285;
    uint256 constant IC11y = 15315276681974409261227849542473082957819796981906742573174073682534882721117;
    
    uint256 constant IC12x = 16547725375515310001960623115172102502108253895951019004414423810234743214185;
    uint256 constant IC12y = 381746682872328866427409078316024876418406725650772024849455272888303073206;
    
    uint256 constant IC13x = 5811772810884556402261506834491793497485793769971976877104010605439310692993;
    uint256 constant IC13y = 951893893655856817644880639004612309367691663740463391635519211515369726473;
    
    uint256 constant IC14x = 3691959036732417982002208379159913356748341614545654390508371496765660690737;
    uint256 constant IC14y = 188051815582033202346437722550689076179629511061129506023007999860638936933;
    
    uint256 constant IC15x = 14445193767778957995445862882873530055157712924992634672835822579343982322677;
    uint256 constant IC15y = 6170969086482675466868236394528259050528210545139074611961714546963117101411;
    
    uint256 constant IC16x = 11691356240480369386691475119971936343816071348947607713218705435643027287859;
    uint256 constant IC16y = 14824364538606857315891571501936850781026004986259523775903249006247494144835;
    
    uint256 constant IC17x = 688146872987597908666303313859429054103523721356156648786238503569881385484;
    uint256 constant IC17y = 4978857830453801159846676791829759308289067134559795532538545770844385979533;
    
    uint256 constant IC18x = 6824950664755180086089392100786250652736941840952347329077912868050146793697;
    uint256 constant IC18y = 10124804305849942349754555026254777303227629641103872873815002370592253328520;
    
    uint256 constant IC19x = 15106599914014371599714338458788026697063150791444815482575591064403616593839;
    uint256 constant IC19y = 6038546875819203054984999503996853623069115281845018988871615006946936184572;
    
    uint256 constant IC20x = 8734981881743400257396828162150963492284840490602540312270919626986697422613;
    uint256 constant IC20y = 8134246278622014941376703993605637205360467220731827740604283588364916294535;
    
    uint256 constant IC21x = 8417515183156263747797258620733311037619688591573341281329758128071224810646;
    uint256 constant IC21y = 3217077194420578679486038833757434784702714429678415732856700801601382175987;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[21] calldata _pubSignals) public view returns (bool) {
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
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                
                g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))
                
                g1_mulAccC(_pVk, IC17x, IC17y, calldataload(add(pubSignals, 512)))
                
                g1_mulAccC(_pVk, IC18x, IC18y, calldataload(add(pubSignals, 544)))
                
                g1_mulAccC(_pVk, IC19x, IC19y, calldataload(add(pubSignals, 576)))
                
                g1_mulAccC(_pVk, IC20x, IC20y, calldataload(add(pubSignals, 608)))
                
                g1_mulAccC(_pVk, IC21x, IC21y, calldataload(add(pubSignals, 640)))
                

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
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            
            checkField(calldataload(add(_pubSignals, 480)))
            
            checkField(calldataload(add(_pubSignals, 512)))
            
            checkField(calldataload(add(_pubSignals, 544)))
            
            checkField(calldataload(add(_pubSignals, 576)))
            
            checkField(calldataload(add(_pubSignals, 608)))
            
            checkField(calldataload(add(_pubSignals, 640)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
