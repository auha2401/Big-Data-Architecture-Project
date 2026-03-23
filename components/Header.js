import { StyleSheet, View, Text } from 'react-native';

export default function Header({street, city}) {

    return (
        <View style={styles.header}>
        <View style={styles.location}>
           <Text style={styles.street}>Near {street || ''}</Text>
           <Text style={styles.city}>{city || ''}</Text>
        </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingBottom: 150,
        paddingLeft: 20,
        paddingTop: 70,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        backgroundColor: '#F08C21',
        borderBottomWidth: 1,
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    location: {
        flexDirection: 'column',
    },
    street: {
        fontSize: 16,
        fontWeight: 'bold',
        color: 'white',
    },
    city:{
        fontSize: 12,
        color: 'white',
    },
  
});
