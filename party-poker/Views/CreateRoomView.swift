//
//  CreateRoomView.swift
//  party-poker
//
//  Created by wang yuqiu on 2025-08-14.
//

import SwiftUI

struct CreateRoomView: View {
    @ObservedObject var roomManager: RoomManager
    let playerName: String
    @Environment(\.presentationMode) var presentationMode
    
    @State private var maxPlayers = 6
    @State private var smallBlind = 10
    @State private var bigBlind = 20
    @State private var startingChips = 1000
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Room Settings")) {
                    HStack {
                        Text("Max Players")
                        Spacer()
                        Picker("Max Players", selection: $maxPlayers) {
                            ForEach(2...8, id: \.self) { count in
                                Text("\(count)").tag(count)
                            }
                        }
                        .pickerStyle(MenuPickerStyle())
                    }
                    
                    HStack {
                        Text("Small Blind")
                        Spacer()
                        TextField("Small Blind", value: $smallBlind, format: .number)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                    }
                    
                    HStack {
                        Text("Big Blind")
                        Spacer()
                        TextField("Big Blind", value: $bigBlind, format: .number)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                    }
                    
                    HStack {
                        Text("Starting Chips")
                        Spacer()
                        TextField("Starting Chips", value: $startingChips, format: .number)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                    }
                }
                
                Section {
                    Button(action: createRoom) {
                        HStack {
                            Spacer()
                            Text("Create Room")
                                .fontWeight(.semibold)
                            Spacer()
                        }
                    }
                    .foregroundColor(.blue)
                }
            }
            .navigationTitle("Create Room")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                leading: Button("Cancel") {
                    presentationMode.wrappedValue.dismiss()
                }
            )
        }
    }
    
    private func createRoom() {
        let settings = RoomSettings(
            maxPlayers: maxPlayers,
            minPlayers: 2,
            smallBlind: smallBlind,
            bigBlind: bigBlind,
            startingChips: startingChips
        )
        
        roomManager.createRoom(hostName: playerName, settings: settings)
        presentationMode.wrappedValue.dismiss()
    }
}